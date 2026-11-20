import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';
import { useDocumentTitle } from '../hooks';

export default function NotFoundPage() {
  useDocumentTitle('Сторінку не знайдено');
  return (
    <EmptyState
      icon="alert"
      title="404: сторінку не знайдено"
      text="Адреса некоректна або сторінку було переміщено."
      action={
        <Link to="/" className="btn btn--primary">
          На дашборд
        </Link>
      }
    />
  );
}
