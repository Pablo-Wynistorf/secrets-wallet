function getInvitationLink() {
  fetch("/invite-token", {
    method: "POST",
    credentials: "include",
  })
    .then((response) => response.json())
    .then((data) => {
      const link = `${location.origin}/login?token=${data.token}`;
      navigator.clipboard.writeText(link);
      return new Noty({
        type: "success",
        layout: "topLeft",
        theme: "metroui",
        text: "Link copied to clipboard!",
        timeout: 2000,
      }).show();
    });
}
