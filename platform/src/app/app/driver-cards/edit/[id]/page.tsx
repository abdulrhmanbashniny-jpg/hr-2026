import { RecordFormPage, recordFormTitle } from '@/components/records/record-form-page';

export async function generateMetadata(props: PageProps<'/app/driver-cards/edit/[id]'>) {
  const { id } = await props.params;
  return { title: await recordFormTitle('driver_cards', id) };
}

export default async function EditRecordPage(props: PageProps<'/app/driver-cards/edit/[id]'>) {
  const { id } = await props.params;
  return <RecordFormPage kind="driver_cards" id={id} />;
}
