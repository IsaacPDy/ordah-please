import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SignInPromptView } from "./sign-in-prompt-view";

describe("SignInPromptView", () => {
  it("renders the brand, tagline, and Google sign-in button when idle", () => {
    const markup = renderToStaticMarkup(
      <SignInPromptView onSignIn={() => undefined} status="idle" />,
    );

    expect(markup).toContain("ordah please");
    expect(markup).toContain("Order together, hassle less.");
    expect(markup).toContain("Sign in with Google");
  });

  it("disables the button and shows opening state while submitting", () => {
    const markup = renderToStaticMarkup(
      <SignInPromptView onSignIn={() => undefined} status="submitting" />,
    );

    expect(markup).toContain("Opening Google…");
    expect(markup).toContain('disabled=""');
  });

  it("shows a safe error message when sign-in fails to start", () => {
    const markup = renderToStaticMarkup(
      <SignInPromptView onSignIn={() => undefined} status="error" />,
    );

    expect(markup).toContain("Google sign-in could not start");
  });

  it("wires the click handler through to the caller", () => {
    const onSignIn = vi.fn();
    renderToStaticMarkup(
      <SignInPromptView onSignIn={onSignIn} status="idle" />,
    );

    expect(onSignIn).not.toHaveBeenCalled();
  });
});
