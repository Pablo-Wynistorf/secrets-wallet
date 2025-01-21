const token = new URLSearchParams(window.location.search).get("token");
const secretsList = document.getElementById("secrets-list");
const addSecretForm = document.getElementById("add-secret-form");
const secretNameInput = document.getElementById("secret-name");
const secretValueInput = document.getElementById("secret-value");
const secretDescriptionInput = document.getElementById("secret-description");
const addSecretBtn = document.getElementById("add-secret-btn");
const exportSecretsBtn = document.getElementById("export-secrets-btn");
const importSecretsBtn = document.getElementById("import-secrets-btn");
const importFileInput = document.getElementById("import-file-input");
const addModal = document.getElementById("add-secret-modal");
const closeAddModalBtn = document.getElementById("close-modal-btn");
const deleteModal = document.getElementById("delete-secret-modal");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
const spinner = document.getElementById("spinner");
let secretToDelete = null;


function displaySecrets(secrets) {
  if (secrets.length > 0) {
    secretsList.innerHTML = secrets
      .map((secret) => {
        const { secretName, secretValue, secretDescription } =
          secret.secretValue;
        const censoredSecretValue = secretValue.replace(/./g, "●");

        return `
          <div id="${secret.secretId}" class="p-6 bg-gray-100 rounded-lg shadow-md mb-6">
            <!-- Secret Name -->
            <div class="mb-4">
              <h3 class="text-lg font-bold text-blue-600">Name</h3>
              <p class="text-gray-800 bg-white px-4 py-2 rounded-lg border shadow-sm overflow-x-auto w-5/6">
                ${secretName}
              </p>
            </div>

            <!-- Secret Value -->
            <div class="mb-4 relative">
              <h3 class="text-lg font-bold text-blue-600">Secret Value</h3>
              <p 
                id="secret-value-${secret.secretId}" 
                class="text-gray-800 bg-white px-4 py-2 rounded-lg border shadow-sm overflow-x-auto w-5/6"
                data-secret-value="${secretValue}"
              >
                ${censoredSecretValue}
              </p>
              <button 
                onclick="toggleSecret('${secret.secretId}')" 
                class="absolute top-[50px] right-16 transform -translate-y-1/2 text-blue-600 hover:text-blue-800"
              >
                <img id="eye-icon-${secret.secretId}" src="svg/eye.svg" alt="View" class="w-6 h-6">
              </button>
              <button 
                onclick="copySecretValue('${secretValue}', '${secret.secretId}')"
                class="absolute top-[50px] right-4 transform -translate-y-1/2 text-blue-600 hover:text-blue-800"
              >
                <img id="copy-icon-${secret.secretId}" src="svg/copy.svg" alt="Copy" class="w-6 h-6">
              </button>
            </div>

            <!-- Secret Description -->
            ${secretDescription ? `
              <div class="mb-4">
                <h3 class="text-lg font-bold text-blue-600">Description</h3>
                <p class="text-gray-800 bg-white px-4 py-2 rounded-lg border shadow-sm max-h-40 overflow-y-auto whitespace-pre-line w-5/6">
                  ${secretDescription}
                </p>
              </div>
            ` : ""}

            <!-- Delete Button -->
            <div class="flex justify-end">
              <button 
                class="flex items-center bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
                onclick="showDeleteModal('${secret.secretId}')"
              >
                <img src="svg/trash.svg" alt="Delete" class="w-5 h-5 mr-2"> Delete
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  } else {
    secretsList.innerHTML = `
      <div class="p-6 bg-gray-100 rounded-lg shadow-md text-center">
        <p class="text-gray-700 text-lg">No secrets found.</p>
      </div>
    `;
  }
}


function filterSecrets() {
  const searchQuery = document.getElementById("search-bar").value.toLowerCase();
  const filteredSecrets = secrets.filter(
    (secret) =>
      secret.secretValue.secretName.toLowerCase().includes(searchQuery) ||
      secret.secretValue.secretDescription.toLowerCase().includes(searchQuery)
  );

  displaySecrets(filteredSecrets);
}


function toggleSecret(secretId) {
  const secretValueElement = document.getElementById(
    `secret-value-${secretId}`
  );
  const eyeIcon = document.getElementById(`eye-icon-${secretId}`);

  const originalSecretValue = secretValueElement.dataset.secretValue;
  const isCensored = secretValueElement.textContent.includes("●");

  if (isCensored) {
    secretValueElement.textContent = originalSecretValue;
    eyeIcon.src = "svg/eye-off.svg";
    eyeIcon.alt = "Hide";
  } else {
    secretValueElement.textContent = originalSecretValue.replace(/./g, "●");
    eyeIcon.src = "svg/eye.svg";
    eyeIcon.alt = "View";
  }
}

function copySecretValue(secretValue, secretId) {
  const copyIcon = document.getElementById(`copy-icon-${secretId}`);
  navigator.clipboard
    .writeText(secretValue)
    .then(() => {
      copyIcon.src = "svg/copy-success.svg";
      displaySuccessMessage("Secret copied to clipboard!");
      setTimeout(() => {
        copyIcon.src = "svg/copy.svg";
      }, 2000);
    })
    .catch((err) => console.error("Failed to copy text: ", err));
}

let secrets;
async function fetchSecrets() {
  const response = await fetch("/api/secrets", {
    method: "GET",
    headers: { Authorization: token },
  });
  if (response.ok) {
    const data = await response.json();
    spinner.classList.add("hidden");
    secrets = data.secrets;
    displaySecrets(data.secrets);
  } else {
    secretsList.innerHTML = `
      <div class="p-4 bg-red-100 rounded-lg shadow-sm text-xl text-red-600">
        Failed to fetch secrets. Please try again.
      </div>`;
  }
}

function showDeleteModal(secretId) {
  secretToDelete = secretId;
  confirmDeleteBtn.removeEventListener("click", handleDelete);
  confirmDeleteBtn.addEventListener("click", handleDelete);
  deleteModal.classList.remove("hidden");
}

function handleDelete() {
  deleteSecret(secretToDelete);
}

function hideDeleteModal() {
  deleteModal.classList.add("hidden");
  secretToDelete = null;
}

async function deleteSecret(secretToDelete) {
  if (!secretToDelete) {
    alert("No secret selected for deletion.");
    return;
  }

  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = "Deleting...";

  try {
    const response = await fetch("/api/secrets", {
      method: "DELETE",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ secretId: secretToDelete }),
    });

    if (response.ok) {
      displaySuccessMessage("Secret deleted successfully!");

      const secretElement = document.getElementById(secretToDelete);
      if (secretElement) {
        secretElement.remove();
      }

      secrets = secrets.filter((secret) => secret.secretId !== secretToDelete);

      hideDeleteModal();
    } else {
      const errorData = await response.json();
      const errorMessage =
        errorData.error || "Failed to delete secret. Please try again.";
      displayErrorMessage(errorMessage);
    }
  } catch (error) {
    displayErrorMessage(
      "An error occurred. Please check your network connection."
    );
  } finally {
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = "Delete";
  }
}

exportSecretsBtn.addEventListener("click", () => {
  const secretsToExport = secrets.map((secret) => {
    const { secretName, secretValue, secretDescription } = secret.secretValue;
    return { secretName, secretValue, secretDescription };
  });

  const data = new Blob([JSON.stringify(secretsToExport)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "secrets.json";
  a.click();

  displaySuccessMessage("Secrets exported successfully!");
});

importSecretsBtn.addEventListener("click", () => {
  importFileInput.click();
});

importFileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    const secretsToImport = JSON.parse(event.target.result);

    try {
      for (const secret of secretsToImport) {
        const { secretName, secretValue, secretDescription } = secret;

        const response = await fetch("/api/secrets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ secretName, secretValue, secretDescription }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage =
            errorData.error || "Failed to import secret. Please try again.";
          displayErrorMessage(errorMessage);
          return;
        }
      }

      displaySuccessMessage("Secrets imported successfully!");
      setTimeout(fetchSecrets, 2000);
    } catch (error) {
      displayErrorMessage(
        "An error occurred. Please check your network connection."
      );
    }
  };

  reader.readAsText(file);
  event.target.value = null;
});

addSecretForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const secretName = secretNameInput.value;
  const secretValue = secretValueInput.value;
  const secretDescription = secretDescriptionInput.value;

  addModal.classList.add("hidden");

  secretNameInput.value = "";
  secretValueInput.value = "";
  secretDescriptionInput.value = "";

  try {
    const response = await fetch("/api/secrets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ secretName, secretValue, secretDescription }),
    });

    if (response.ok) {
      displaySuccessMessage("Secret added successfully!");
      setTimeout(fetchSecrets, 2000);
    } else {
      const errorData = await response.json();
      const errorMessage =
        errorData.error || "Secret addition failed. Please try again.";
      displayErrorMessage(errorMessage);
    }
  } catch (error) {
    displayErrorMessage(
      "An error occurred. Please check your network connection."
    );
  }
});

function displaySuccessMessage(message) {
  new Noty({
    type: "success",
    layout: "topLeft",
    theme: "metroui",
    text: message,
    timeout: 2000,
  }).show();
}

function displayErrorMessage(error) {
  new Noty({
    type: "error",
    layout: "topLeft",
    theme: "metroui",
    text: error,
    timeout: 3000,
  }).show();
}

addSecretBtn.addEventListener("click", () =>
  addModal.classList.remove("hidden")
);
closeAddModalBtn.addEventListener("click", () =>
  addModal.classList.add("hidden")
);
cancelDeleteBtn.addEventListener("click", hideDeleteModal);

window.onload = fetchSecrets;
