function copyInvitationLink() {
  const permissions = document.getElementById("permissions").value;

  if (!permissions || permissions.trim() === "") {
    return displayErrorMessage(
      "Permissions cannot be empty. Please specify at least one permission."
    );
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
        document.getElementById("copyLinkBtn").textContent = "Copied!";
        document.getElementById("copyLinkBtn").disabled = true;
        displaySuccessMessage("Link copied to clipboard!");
        showQRCode(link);
      });
    })
    .catch((error) => {
      displayErrorMessage(error.message || "An unexpected error occurred.");
    });
}

document.getElementById("permissions").addEventListener("input", () => {
  document.getElementById("copyLinkBtn").textContent = "Copy Link";
  document.getElementById("copyLinkBtn").disabled = false;
  document.getElementById("qrCodeContainer").classList.add("hidden");
});

function showQRCode(url) {
  document.getElementById("qrcode").innerHTML = "";
  const qrCodeContainer = document.getElementById("qrCodeContainer");
  qrCodeContainer.classList.remove("hidden");
  new QRCode(document.getElementById("qrcode"), url);
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
