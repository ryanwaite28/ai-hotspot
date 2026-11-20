export default function SettingsPage() {
  return (
    <section>
      <h1>Settings</h1>
      <form>
        <fieldset>
          <legend>Notification preferences</legend>
          <label><input type="checkbox" name="email-replies" /> Reply email notifications</label>
          <label><input type="checkbox" name="email-live" /> Live email notifications</label>
        </fieldset>
        <button type="button">Save preferences</button>
      </form>
    </section>
  );
}
