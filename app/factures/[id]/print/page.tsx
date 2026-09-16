import FacturePrintView from "@/components/FacturePrintView";

export default function PrintFacturePage({ params }: { params: { id: string } }) {
  return <FacturePrintView id={params.id} />;
}
