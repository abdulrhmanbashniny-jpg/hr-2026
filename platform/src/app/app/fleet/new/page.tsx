import { RecordFormPage, recordFormTitle } from '@/components/records/record-form-page';

export async function generateMetadata() {
  return { title: await recordFormTitle('vehicles', null) };
}

export default function NewRecordPage() {
  return <RecordFormPage kind="vehicles" id={null} />;
}
