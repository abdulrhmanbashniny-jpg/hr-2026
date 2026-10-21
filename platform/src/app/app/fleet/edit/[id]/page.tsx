import { RecordFormPage, recordFormTitle } from '@/components/records/record-form-page';

export async function generateMetadata(props: PageProps<'/app/fleet/edit/[id]'>) {
  const { id } = await props.params;
  return { title: await recordFormTitle('vehicles', id) };
}

export default async function EditRecordPage(props: PageProps<'/app/fleet/edit/[id]'>) {
  const { id } = await props.params;
  return <RecordFormPage kind="vehicles" id={id} />;
}
