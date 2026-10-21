import { RecordFormPage, recordFormTitle } from '@/components/records/record-form-page';

export async function generateMetadata() {
  return { title: await recordFormTitle('residents', null) };
}

export default function NewRecordPage() {
  return <RecordFormPage kind="residents" id={null} />;
}
