"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { useCartStore } from "../hooks/useCartStore";
import { useUIStore } from "../hooks/useUIStore";

export default function NavIcons() {
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const counter = useCartStore((s) => s.counter);
  const setCartOpen = useUIStore((s) => s.setCartOpen);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);

  React.useEffect(() => {
    if (!isSignedIn) {
      setIsAdmin(false);
      return;
    }

    fetch("/api/account/role")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Role request failed (${res.status})`);
        return (await res.json()) as { isAdmin: boolean };
      })
      .then((data) => setIsAdmin(data.isAdmin))
      .catch((error) => {
        console.warn("[account] could not resolve admin role:", error);
        setIsAdmin(false);
      });
  }, [isSignedIn]);

  const handleProfile = () => {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }
    setProfileOpen((s) => !s);
  };

  return (
    <>
      <button className="fs-icon-btn" aria-label="Account" onClick={handleProfile}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="7" r="3.2" />
          <path d="M3.5 17a6.5 6.5 0 0 1 13 0" />
        </svg>
      </button>
      {profileOpen && isSignedIn && user && (
        <div className="absolute right-12 top-14 z-30 bg-bg-card border border-[var(--fs-line)] rounded-lg shadow-lg p-3 text-sm flex flex-col gap-2 min-w-[180px]">
          <div className="text-xs text-ink-mute pb-2 mb-1 border-b border-[var(--fs-line-soft)]">
            Signed in as <b className="text-ink">{user.primaryEmailAddress?.emailAddress}</b>
          </div>
          <button className="text-left" onClick={() => { setProfileOpen(false); router.push("/account"); }}>
            Account
          </button>
          <button className="text-left" onClick={() => { setProfileOpen(false); router.push("/account/orders"); }}>
            Orders
          </button>
          {isAdmin && (
            <button className="text-left" onClick={() => { setProfileOpen(false); router.push("/admin"); }}>
              Admin
            </button>
          )}
          <button className="text-left text-ink-mute" onClick={() => signOut({ redirectUrl: "/" })}>
            Sign out
          </button>
        </div>
      )}
      <button className="fs-icon-btn fs-cart-btn" onClick={() => setCartOpen(true)} aria-label="Basket">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 6h12l-1.2 8.4a2 2 0 0 1-2 1.6H7.2a2 2 0 0 1-2-1.6L4 6Z" />
          <path d="M7 6V4.5a3 3 0 0 1 6 0V6" />
        </svg>
        {counter > 0 && <span className="fs-cart-badge">{counter}</span>}
      </button>
    </>
  );
}
