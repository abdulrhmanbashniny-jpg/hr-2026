import { RecordFormPage, recordFormTitle } from '@/components/records/record-form-page';

export async function generateMetadata(props: PageProps<'/app/gosi/edit/[id]'>) {
  const { id } = await props.params;
  return { title: await recordFormTitle('gosi', id) };
}

export default async function EditRecordPage(props: PageProps<'/app/gosi/edit/[id]'>) {
  const { id } = await props.params;
  return <RecordFormPage kind="gosi" id={id} />;
}
