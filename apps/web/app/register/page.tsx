export default function RegisterPage() {
  return (
    <section>
      <h1>Create account</h1>
      <form>
        <label htmlFor="handle">Handle</label><input id="handle" name="handle" />
        <label htmlFor="email">Email</label><input id="email" type="email" name="email" />
        <label htmlFor="password">Password</label><input id="password" type="password" name="password" />
        <button type="submit">Register</button>
      </form>
    </section>
  );
}
