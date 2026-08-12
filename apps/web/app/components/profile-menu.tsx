"use client";

import { LogOut } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { authClient } from "../../src/auth/auth-client";

type ProfileMenuStatus = "idle" | "signing-out" | "error";

type ProfileMenuProps = Readonly<{
  displayName: string;
  email: string;
  imageUrl: string | null;
  signOut?: () => Promise<unknown>;
}>;

const FALLBACK_NAME = "Your account";

/** Picks the uppercase first letter of a display name, or `?` when none is available. */
function getInitial(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "?";
  }
  return trimmed.charAt(0).toUpperCase();
}

/** Renders the user's avatar with a dropdown profile panel and sign-out action. */
export function ProfileMenu({
  displayName,
  email,
  imageUrl,
  signOut = authClient.signOut,
}: ProfileMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ProfileMenuStatus>("idle");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    }
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [open]);

  async function handleSignOut() {
    setStatus("signing-out");
    try {
      await signOut();
      setOpen(false);
      setStatus("idle");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  const resolvedName =
    displayName.trim().length > 0 ? displayName : FALLBACK_NAME;
  const ariaLabel =
    email.length > 0
      ? `Open profile menu for ${resolvedName} (${email})`
      : `Open profile menu for ${resolvedName}`;

  return (
    <div className="profile-menu" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        className="profile-menu__avatar-button"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {imageUrl && imageUrl.length > 0 ? (
          <Image
            alt=""
            className="profile-avatar"
            height={44}
            src={imageUrl}
            unoptimized
            width={44}
          />
        ) : (
          <span aria-hidden="true" className="profile-menu__initials">
            {getInitial(displayName)}
          </span>
        )}
      </button>
      {open ? (
        <div className="profile-menu__panel" role="menu">
          <div className="profile-menu__identity">
            <span className="profile-menu__name">{resolvedName}</span>
            {email.length > 0 ? (
              <span className="profile-menu__email" title={email}>
                {email}
              </span>
            ) : null}
          </div>
          <div className="profile-menu__divider" />
          {status === "error" ? (
            <div className="profile-menu__error" role="alert">
              <span>Could not sign out.</span>
              <button
                className="profile-menu__retry"
                onClick={() => {
                  void handleSignOut();
                }}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : (
            <button
              className="profile-menu__sign-out"
              disabled={status === "signing-out"}
              onClick={() => {
                void handleSignOut();
              }}
              type="button"
            >
              <LogOut aria-hidden="true" size={16} />
              <span>
                {status === "signing-out" ? "Signing out…" : "Sign out"}
              </span>
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
