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

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    const token = req.cookies.token;
    if (token) {
        return res.redirect('/wallet?token=' + token);
    }
    res.redirect('/welcome');
});

app.get('/api/create-wallet', async (req, res) => {
    const walletId = uuidv4();
    const token = jwt.sign({ uuid: walletId }, JWT_SECRET_KEY);
    res.redirect(`/wallet?token=${token}`);
});

app.get('/api/secrets', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).send('Unauthorized');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET_KEY);
        const uuid = decoded.uuid;
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
        return res.status(500).send('Internal Server Error');
    }
});

// New route to add parameters (secrets)
app.post('/api/secrets', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).send('Unauthorized');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET_KEY);
        const uuid = decoded.uuid;

        const { secretName, secretValue, secretDescription = '' } = req.body;

        if (!secretName || !secretValue) {
            return res.status(400).send('Missing secretName or secretValue');
        }

        const totalLength = secretName.length + secretValue.length + secretDescription.length;

        if (totalLength > 4039) {
            return res.status(400).send('The combined length of secretName, secretValue, and secretDescription cannot exceed 4039 characters');
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

        return res.status(201).send('Secret added successfully');
    } catch (error) {
        console.error('Error adding secret:', error);
        return res.status(500).send('Internal Server Error');
    }
});


// Delete parameters (secrets)
app.delete('/api/secrets', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).send('Unauthorized');
    }
    const { secretId } = req.body;

    if (!secretId) {
        return res.status(400).send('Missing secretId in request body');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET_KEY);
        const uuid = decoded.uuid;

        const fullParameterName = `/valueStore/${uuid}/${secretId}`;

        const getParameterCommand = new GetParameterCommand({ Name: fullParameterName, WithDecryption: true });
        const parameterResponse = await client.send(getParameterCommand);

        if (!parameterResponse.Parameter) {
            return res.status(404).send('Parameter not found');
        }

        const parameterData = JSON.parse(parameterResponse.Parameter.Value);

        console.log('Updating parameter:', parameterData);

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

        return res.status(200).send('Parameter marked for deletion');
    } catch (error) {
        console.error('Error deleting parameter:', error);
        return res.status(500).send('Internal Server Error');
    }
});

export const handler = serverless(app);
