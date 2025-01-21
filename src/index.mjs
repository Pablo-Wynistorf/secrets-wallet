import express from 'express';
import serverless from 'serverless-http';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { SSMClient, GetParameterCommand, PutParameterCommand, DeleteParameterCommand, DescribeParametersCommand } from "@aws-sdk/client-ssm";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new SSMClient({ region: 'eu-central-1' });

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;


app.get('/wallet', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect('/welcome');
    }
    res.sendFile(path.join(__dirname, 'public/wallet'));
});


app.get('/invite', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect('/welcome');
    }
    res.sendFile(path.join(__dirname, 'public/invite'));
});

app.post('/invite-token', (req, res) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({ error: 'Authentication required. Please log in.' });
        }

        const { permissions } = req.body;

        if (!permissions) {
            return res.status(400).json({ error: 'Invalid or missing permissions in request body.' });
        }

        if (!permissions.includes('R') && !permissions.includes('CR') && !permissions.includes('CRD')) {
            return res.status(400).json({ error: 'Invalid permissions. Please specify either R, CR or CRD.' });
        }        

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET_KEY);
        } catch (err) {
            return res.status(401).json({ error: 'Invalid token. Please log in again.' });
        }

        if (!decoded.permissions.includes('CRD')) {
            return res.status(403).json({ error: 'You are not allowed to invite users.' });
        }

        const inviteToken = jwt.sign(
            { uuid: decoded.uuid, permissions },
            JWT_SECRET_KEY,
        );
        return res.status(200).json({ inviteToken });

    } catch (error) {
        console.error('Error processing /invite-token:', error);
        return res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
    }
});


app.get('/login', (req, res) => {
    const token = req.query.token;
    if (!token) {
        return res.redirect('/welcome');
    }
    res.cookie('token', token, { httpOnly: true, expires: new Date(253402300000000) });
    res.redirect('/wallet');
});

app.get('/logout', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect('/welcome');
    }
    res.clearCookie('token');
    res.redirect('/welcome');
});


app.get('/welcome', (req, res) => {
    const token = req.cookies.token;
    if (token) {
        return res.redirect('/wallet');
    }
    res.sendFile(path.join(__dirname, 'public/welcome'));
});


app.get('/', (req, res) => {
    const token = req.cookies.token;
    if (token) {
        return res.redirect('/wallet');
    }
    res.redirect('/welcome');
});


app.use(express.static(path.join(__dirname, 'public')));


app.get('/api/create-wallet', async (req, res) => {
    const walletId = uuidv4();
    const token = jwt.sign({ uuid: walletId, permissions: "CRD" }, JWT_SECRET_KEY);
    res.cookie('token', token, { httpOnly: true, expires: new Date(253402300000000) });
    res.redirect('/wallet');
});


app.get('/api/secrets', async (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET_KEY);
        const uuid = decoded.uuid;
        const permissions = decoded.permissions;

        if (!permissions.includes('R')) {
            return res.status(403).json({ error: 'You are not allowed to read secrets', text: permissions });
        }

        const parameterPrefix = `/valueStore/${uuid}`;

        const describeCommand = new DescribeParametersCommand({
            ParameterFilters: [{ Key: 'Name', Option: 'BeginsWith', Values: [parameterPrefix] }]
        });

        const describeResponse = await client.send(describeCommand);

        if (!describeResponse.Parameters || describeResponse.Parameters.length === 0) {
            return res.json({ secrets: [] });
        }

        const parametersPromises = describeResponse.Parameters.map(async (parameter) => {
            try {
                const getParameterCommand = new GetParameterCommand({ Name: parameter.Name, WithDecryption: true });
                const parameterResponse = await client.send(getParameterCommand);

                const parameterData = parameterResponse.Parameter ? JSON.parse(parameterResponse.Parameter.Value) : {};

                return {
                    secretId: parameter.Name.split('/')[3],
                    secretValue: parameterData,
                };
            } catch (err) {
                console.error('Error fetching parameter:', err);
                return { error: `Error fetching parameter for ${parameter.Name}` };
            }
        });

        const allSecrets = await Promise.all(parametersPromises);

        const activeSecrets = allSecrets.filter(secret => secret.secretValue);

        return res.json({ secrets: activeSecrets });
    } catch (error) {
        console.error('Error fetching secrets:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.post('/api/secrets', async (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET_KEY);
        const uuid = decoded.uuid;
        const permissions = decoded.permissions;

        if (!permissions.includes('C')) {
            return res.status(403).json({ error: 'You are not allowed to create secrets' });
        }

        const { secretName, secretValue, secretDescription = '' } = req.body;

        if (!secretName || !secretValue) {
            return res.status(400).json({ error: 'Missing secretName or secretValue in request body' });
        }

        const totalLength = secretName.length + secretValue.length + secretDescription.length;

        if (totalLength > 4039) {
            return res.status(400).json({ error: 'Total length of secretName, secretValue, and secretDescription must be less than 4039 characters' });
        }

        const parameterPrefix = `/valueStore/${uuid}`;
        const secretId = uuidv4();

        const fullParameterName = `${parameterPrefix}/${secretId}`;

        const parameterString = JSON.stringify({ secretName, secretValue, secretDescription });

        const putParameterCommand = new PutParameterCommand({
            Name: fullParameterName,
            Value: parameterString,
            Type: 'SecureString',
            KeyId: 'alias/aws/ssm',
            Overwrite: true,
        });

        await client.send(putParameterCommand);

        return res.status(200).json({ success: 'Successfully added secret' });
    } catch (error) {
        console.error('Error adding secret:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.delete('/api/secrets', async (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { secretId } = req.body;

    if (!secretId) {
        return res.status(400).json({ error: 'Missing secretId in request body' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET_KEY);
        const uuid = decoded.uuid;
        const permissions = decoded.permissions;

        if (!permissions.includes('D')) {
            return res.status(403).json({ error: 'You are not allowed to delete secrets' });
        }

        const fullParameterName = `/valueStore/${uuid}/${secretId}`;

        const getParameterCommand = new GetParameterCommand({ Name: fullParameterName, WithDecryption: true });
        const parameterResponse = await client.send(getParameterCommand);

        if (!parameterResponse.Parameter) {
            return res.status(404).json({ error: 'Secret not found' });
        }

        const parameterData = JSON.parse(parameterResponse.Parameter.Value);

        const putParameterCommand = new PutParameterCommand({
            Name: fullParameterName,
            Value: JSON.stringify(parameterData),
            Type: 'SecureString',
            KeyId: 'alias/aws/ssm',
            Overwrite: true,
        });

        await client.send(putParameterCommand);

        const deleteParameterCommand = new DeleteParameterCommand({ Name: fullParameterName });
        await client.send(deleteParameterCommand);

        return res.status(200).json({ success: 'Successfully deleted secret' });
    } catch (error) {
        console.error('Error deleting parameter:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});


export const handler = serverless(app);