import { RecordFormPage, recordFormTitle } from '@/components/records/record-form-page';

export async function generateMetadata() {
  return { title: await recordFormTitle('gosi', null) };
}

export default function NewRecordPage() {
  return <RecordFormPage kind="gosi" id={null} />;
}
