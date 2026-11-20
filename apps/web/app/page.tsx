export default function HomePage() {
  return (
    <section>
      <h1>Chronological feed</h1>
      <p className="status-banner">Feed results are server-ordered. The UI does not rank or personalize content locally.</p>
      <div className="card-grid">
        <article className="card"><h2>Following</h2><p>Recent posts from accounts you follow.</p></article>
        <article className="card"><h2>Public</h2><p>Chronological public posts.</p></article>
        <article className="card"><h2>Topics</h2><p>Explicitly selected topic feeds.</p></article>
      </div>
    </section>
  );
}
