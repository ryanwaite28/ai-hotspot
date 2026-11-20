export default function VerifyPage() {
  return (
    <section>
      <h1>Verify email</h1>
      <p>Enter the verification token received by email.</p>
      <form>
        <label htmlFor="verification-token">Verification token</label>
        <input id="verification-token" name="token" />
        <button type="submit">Verify</button>
      </form>
    </section>
  );
}
