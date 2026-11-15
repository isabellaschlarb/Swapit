import Link from "next/link";
export default function MissingCloset() {
  return <main className="space-y-3 px-5 py-8"><h1 className="text-xl font-bold text-navy">Closet unavailable</h1><p>This profile is no longer available or is outside your school.</p><Link href="/explore?mode=people" className="text-navy underline">Find people at your school</Link></main>;
}
