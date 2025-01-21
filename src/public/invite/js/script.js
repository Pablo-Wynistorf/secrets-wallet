function copyInvitationLink() {
  const permissions = document.getElementById("permissions").value;

  if (!permissions || permissions.trim() === "") {
    return displayErrorMessage("Permissions cannot be empty. Please specify at least one permission.");
  }

  fetch("/invite-token", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ permissions: permissions }),
  })
    .then(async (response) => {
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "An unexpected error occurred.");
      }
      return data;
    })
    .then((data) => {
      const link = `${location.origin}/login?token=${data.inviteToken}`;

      return navigator.clipboard.writeText(link).then(() => {
        displaySuccessMessage("Link copied to clipboard!");
      });
    })
    .catch((error) => {
      displayErrorMessage(error.message || "An unexpected error occurred.");
    });
}

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
