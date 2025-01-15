function copyInvitationLink() {
  const permissions = document.getElementById("permissions").value;

  fetch("/invite-token", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ permissions: permissions }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch the invitation link.");
      }
      return response.json();
    })
    .then((data) => {
      const link = `${location.origin}/login?token=${data.inviteToken}`;

      return navigator.clipboard.writeText(link).then(() => {
        new Noty({
          type: "success",
          layout: "topLeft",
          theme: "metroui",
          text: "Link copied to clipboard!",
          timeout: 2000,
        }).show();
      });
    })
    .catch((error) => {
      console.error("Error:", error);
      new Noty({
        type: "error",
        layout: "topLeft",
        theme: "metroui",
        text: "Failed to copy the link. Please try again.",
        timeout: 3000,
      }).show();
    });
}
