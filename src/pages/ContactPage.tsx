import Contact from '../components/Contact';
import { usePublicContext } from '../components/PublicLayout';

export default function ContactPage() {
  const { settings, onTicketCreated } = usePublicContext();

  return (
    <div className="pt-16">
      <Contact settings={settings} onTicketCreated={onTicketCreated} />
    </div>
  );
}
