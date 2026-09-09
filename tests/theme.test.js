// Minimal DOM test double for Node unit tests; no browser or runtime dependency.
class Element extends EventTarget {
  constructor(tagName) {
    super();
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.className = "";
    this.hidden = false;
    this.value = "";
    this._text = "";
    this.classList = {
      contains: name => this.className.split(/\s+/).includes(name),
      toggle: (name, enabled) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        const add = enabled ?? !classes.has(name);
        if (add) classes.add(name); else classes.delete(name);
        this.className = [...classes].join(" ");
        return add;
      },
      add: name => this.classList.toggle(name, true),
      remove: name => this.classList.toggle(name, false),
    };
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(node => node.textContent).join(""); }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "class") this.className = String(value);
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this._text = ""; this.children = nodes; }
  click() { this.dispatchEvent(new Event("click")); }
}

export function installDocument(t, ids = []) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  const nodes = new Map(ids.map(id => [id, new Element("div")]));
  const document = new EventTarget();
  document.documentElement = new Element("html");
  document.getElementById = id => nodes.get(id);
  document.createElement = tagName => new Element(tagName);
  document.createElementNS = (_, tagName) => new Element(tagName);
  globalThis.document = document;
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "document", original);
    else delete globalThis.document;
  });
  return { document, nodes };
}
