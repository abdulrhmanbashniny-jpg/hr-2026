import { RecordFormPage, recordFormTitle } from '@/components/records/record-form-page';

export async function generateMetadata(props: PageProps<'/app/operating-cards/edit/[id]'>) {
  const { id } = await props.params;
  return { title: await recordFormTitle('operating_cards', id) };
}

export default async function EditRecordPage(props: PageProps<'/app/operating-cards/edit/[id]'>) {
  const { id } = await props.params;
  return <RecordFormPage kind="operating_cards" id={id} />;
}
