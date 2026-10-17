import { Page, PageHeader } from "../../components/Layout";
import { SecurityLog } from "./SecurityLog";

export default function Audit() {
  return (
    <>
      <PageHeader title="Аудит и безопасность" subtitle="Журнал действий пользователей и события безопасности учебных сред" />
      <Page><SecurityLog /></Page>
    </>
  );
}
