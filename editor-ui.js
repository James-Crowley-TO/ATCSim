export function field(parent, name, label, { value = "", type = "text", options, required = false } = {}) {
  const wrapper = document.createElement("label");
  wrapper.className = "editor-field";
  const caption = document.createElement("span");
  caption.textContent = label;
  const input = document.createElement(options ? "select" : "input");
  input.name = name;
  input.setAttribute("aria-label", label);
  if (options) for (const option of options) {
    const node = document.createElement("option");
    node.value = typeof option === "string" ? option : option.value;
    node.textContent = typeof option === "string" ? option : option.label;
    input.append(node);
  }
  else {
    input.type = type;
    if (type === "number") input.step = "any";
  }
  input.value = value ?? "";
  input.required = required;
  wrapper.append(caption, input);
  parent.append(wrapper);
  return input;
}

export function showErrors(container, errors, controls = {}) {
  container.replaceChildren();
  for (const control of Object.values(controls)) control.removeAttribute("aria-invalid");
  for (const [key, message] of Object.entries(errors)) {
    const line = document.createElement("p");
    const control = controls[key];
    const caption = control?.parentElement.querySelector("span")?.textContent;
    line.textContent = `${caption ? `${caption}: ` : ""}${message}`;
    container.append(line);
    control?.setAttribute("aria-invalid", "true");
  }
  container.hidden = !Object.keys(errors).length;
}
