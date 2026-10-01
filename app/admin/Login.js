"use client";

import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      setError((await res.json().catch(() => ({}))).error || "로그인에 실패했습니다");
      setBusy(false);
    }
  }

  return (
    <div className="admin">
      <header className="sheet-head">
        <span>PORTFOLIO</span>
        <span>ADMIN</span>
      </header>
      <div className="login">
        <form onSubmit={submit}>
          <h1>관리자 로그인</h1>
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button className="btn primary" disabled={busy || !password}>
            {busy ? "확인 중…" : "로그인"}
          </button>
          <div className="status error">{error}</div>
        </form>
      </div>
    </div>
  );
}
