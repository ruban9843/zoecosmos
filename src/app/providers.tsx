"use client";
import CartBoot from "../hooks/CartBoot";

/** Top-level client providers. ClerkProvider is mounted in the root layout. */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CartBoot />
      {children}
    </>
  );
}
