import { CreateTeamForm } from "@/components/teams/CreateTeamForm";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NewTeamPage() {
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=%2Fteams%2Fnew");
  return <main style={{maxWidth:560,margin:"12vh auto",padding:24,fontFamily:"system-ui"}}>
    <h1>Create your team workspace</h1>
    <p>Your account will become the first team owner.</p>
    <CreateTeamForm />
  </main>;
}
