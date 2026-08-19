export default function ErrorNotice({ message }: { message: string }) {
  if (!message) return null;
  return <p className="error-notice" role="alert">{message}</p>;
}
