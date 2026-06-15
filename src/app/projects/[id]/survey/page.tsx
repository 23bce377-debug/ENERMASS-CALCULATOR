export default function SurveyPage({ params }: { params: { id: string } }) {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-light mb-8">Site Survey: {params.id}</h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-500">Site survey intake form coming soon.</p>
      </div>
    </div>
  );
}
