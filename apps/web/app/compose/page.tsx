export default function ComposePage() {
  return (
    <section>
      <h1>Compose</h1>
      <form>
        <label htmlFor="post-body">Post text</label>
        <textarea id="post-body" name="body" maxLength={5000} rows={6} />
        <label htmlFor="visibility">Visibility</label>
        <select id="visibility" name="visibility"><option>public</option><option>followers</option><option>private</option></select>
        <button type="submit">Publish</button>
      </form>
    </section>
  );
}
