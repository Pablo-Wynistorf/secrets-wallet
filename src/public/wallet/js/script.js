const token = new URLSearchParams(window.location.search).get("token");
const secretsList = document.getElementById("secrets-list");
const addSecretForm = document.getElementById("add-secret-form");
const secretNameInput = document.getElementById("secret-name");
const secretValueInput = document.getElementById("secret-value");
const secretDescriptionInput = document.getElementById("secret-description");
const addSecretBtn = document.getElementById("add-secret-btn");
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
        const { secretName, secretValue, secretDescription } = secret.secretValue;
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
            <div class="mb-4">
              <h3 class="text-lg font-bold text-blue-600">Description</h3>
              <p 
                class="text-gray-800 bg-white px-4 py-2 rounded-lg border shadow-sm max-h-40 overflow-y-auto whitespace-pre-line w-5/6"
              >${secretDescription}</p>
            </div>

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
      </div>`;
  }
}



// Toggle visibility of a secret
function toggleSecret(secretId) {
  const secretValueElement = document.getElementById(`secret-value-${secretId}`);
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



// Copy secret value to clipboard
function copySecretValue(secretValue, secretId) {
  const copyIcon = document.getElementById(`copy-icon-${secretId}`);
  navigator.clipboard
    .writeText(secretValue)
    .then(() => {
      copyIcon.src = "svg/copy-success.svg";
      new Noty({
        type: "success",
        layout: "topLeft",
        theme: "metroui",
        text: "Secret copied to clipboard!",
        timeout: 2000,
      }).show();
      setTimeout(() => {
        copyIcon.src = "svg/copy.svg";
      }, 2000);
    })
    .catch((err) => console.error("Failed to copy text: ", err));
}

// Fetch secrets
async function fetchSecrets() {
  const response = await fetch("/api/secrets", {
    method: "GET",
    headers: { Authorization: token },
  });
  if (response.ok) {
    const data = await response.json();
    spinner.classList.add("hidden");
    displaySecrets(data.secrets);
  } else {
    secretsList.innerHTML = `
      <div class="p-4 bg-red-100 rounded-lg shadow-sm text-red-600">
        Failed to fetch secrets. Please try again.
      </div>`;
  }
}

// Show Delete Modal
function showDeleteModal(secretId) {
  secretToDelete = secretId;
  confirmDeleteBtn.removeEventListener("click", handleDelete);
  confirmDeleteBtn.addEventListener("click", handleDelete);
  deleteModal.classList.remove("hidden");
}

function handleDelete() {
  deleteSecret(secretToDelete);
}

// Hide Delete Modal
function hideDeleteModal() {
  deleteModal.classList.add("hidden");
  secretToDelete = null;
}

// Delete Secret
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
      new Noty({
        type: "success",
        layout: "topLeft",
        theme: "metroui",
        text: "Secret deleted successfully!",
        timeout: 3000,
      }).show();

      const secretElement = document.getElementById(secretToDelete);
      if (secretElement) {
        secretElement.remove();
      }

      hideDeleteModal();
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = "Delete";
    } else {
      const errorData = await response.json();
      console.error("Error deleting secret:", errorData);
      alert("Failed to delete secret. Please try again.");
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = "Delete";
    }
  } catch (error) {
    console.error("Network or server error:", error);
    alert("An error occurred while deleting the secret. Please try again.");
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = "Delete";
  }
}


// Event Listeners
addSecretForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const secretName = secretNameInput.value;
  const secretValue = secretValueInput.value;
  const secretDescription = secretDescriptionInput.value;

  addModal.classList.add("hidden");

  secretNameInput.value = "";
  secretValueInput.value = "";
  secretDescriptionInput.value = "";

  const response = await fetch("/api/secrets", {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ secretName, secretValue, secretDescription }),
  });

  if (response.ok) {
    new Noty({
      type: "success",
      layout: "topLeft",
      theme: "metroui",
      text: "Secret added successfully!",
      timeout: 3000,
    }).show();
    setTimeout(fetchSecrets, 2000);
  } else {
    new Noty({
      type: "error",
      layout: "topLeft",
      theme: "metroui",
      text: "Secret addition failed. Please try again.",
      timeout: 3000,
    }).show();
  }
});

addSecretBtn.addEventListener("click", () =>
  addModal.classList.remove("hidden")
);
closeAddModalBtn.addEventListener("click", () =>
  addModal.classList.add("hidden")
);
cancelDeleteBtn.addEventListener("click", hideDeleteModal);

window.onload = fetchSecrets;
