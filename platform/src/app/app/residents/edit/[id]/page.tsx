import { RecordFormPage, recordFormTitle } from '@/components/records/record-form-page';

export async function generateMetadata(props: PageProps<'/app/residents/edit/[id]'>) {
  const { id } = await props.params;
  return { title: await recordFormTitle('residents', id) };
}

export default async function EditRecordPage(props: PageProps<'/app/residents/edit/[id]'>) {
  const { id } = await props.params;
  return <RecordFormPage kind="residents" id={id} />;
}
