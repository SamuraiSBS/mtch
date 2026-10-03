import { SpecialistProfileScreen } from "@/components/workspace-specialist-profile";

export default async function SpecialistPublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div className="specialist-dashboard specialist-dashboard--public">
    <div className="specialist-dashboard__main"><SpecialistProfileScreen profileId={id} /></div>
  </div>;
}
