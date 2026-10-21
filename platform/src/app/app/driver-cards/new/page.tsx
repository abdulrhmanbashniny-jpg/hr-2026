import { RecordFormPage, recordFormTitle } from '@/components/records/record-form-page';

export async function generateMetadata() {
  return { title: await recordFormTitle('driver_cards', null) };
}

export default function NewRecordPage() {
  return <RecordFormPage kind="driver_cards" id={null} />;
}
