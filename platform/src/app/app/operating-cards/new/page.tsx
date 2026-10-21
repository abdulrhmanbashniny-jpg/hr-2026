import { RecordFormPage, recordFormTitle } from '@/components/records/record-form-page';

export async function generateMetadata() {
  return { title: await recordFormTitle('operating_cards', null) };
}

export default function NewRecordPage() {
  return <RecordFormPage kind="operating_cards" id={null} />;
}
