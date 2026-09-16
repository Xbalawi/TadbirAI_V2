import DevisPrintView from "@/components/DevisPrintView";

export default function PrintDevisPage({ params }: { params: { id: string } }) {
  return <DevisPrintView id={params.id} />;
}
