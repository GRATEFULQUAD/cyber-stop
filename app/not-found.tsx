import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "#000",
        color: "#fff",
        textAlign: "center",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 900, color: "rgb(0,255,240)" }}>404</h1>
      <p style={{ color: "rgba(255,255,255,0.6)" }}>This page doesn&apos;t exist.</p>
      <Link
        href="/"
        style={{
          padding: "10px 20px",
          borderRadius: 10,
          background: "rgb(0,255,240)",
          color: "#000",
          fontWeight: 700,
        }}
      >
        Back to Cyber Stop
      </Link>
    </div>
  );
}
