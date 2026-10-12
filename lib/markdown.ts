import MarkdownIt from "markdown-it";

// html: false — raw HTML in a post is escaped, never rendered. Post bodies come
// from an AI drafter, so they are treated as untrusted text.
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

const defaultLink = md.renderer.rules.link_open || ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet("href") || "";
  if (/^https?:\/\//.test(href) && !href.startsWith("https://kriosity.in")) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener noreferrer");
  }
  return defaultLink(tokens, idx, options, env, self);
};

export const renderMarkdown = (src: string) => md.render(src || "");

export const readingMinutes = (src: string) => Math.max(1, Math.round((src || "").split(/\s+/).length / 220));
