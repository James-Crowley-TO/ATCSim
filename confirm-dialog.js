// A themed, keyboard-accessible confirmation keeps all dialogs inside the app.
export function confirmAction(message) {
  const dialog = document.getElementById("confirm-dialog");
  if (dialog.open) return Promise.resolve(false);
  document.getElementById("confirm-message").textContent = message;
  dialog.returnValue = "cancel";
  return new Promise(resolve => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "accept"), { once: true });
    dialog.showModal();
  });
}
