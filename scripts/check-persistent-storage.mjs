import { accessSync, constants, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const decode = value => value.replace(/\\040/g," ").replace(/\\011/g,"\t").replace(/\\134/g,"\\");
export const parseMountInfo = contents => contents.split("\n").filter(Boolean).map(line=>{const [left,right]=line.split(" - ");return{mountPoint:decode(left?.split(" ")[4]??""),fileSystem:right?.split(" ")[0]??""};});
export function checkPersistentStorage(environment=process.env,mountInfo){
  const renderProduction=environment.NODE_ENV==="production"&&environment.RENDER==="true";
  const required=renderProduction||environment.MENTOR_REQUIRE_PERSISTENT_STORAGE==="1";
  if(!required)return;
  const mountPath=environment.MENTOR_PERSISTENT_MOUNT_PATH;const dataDirectory=environment.MENTOR_DATA_DIRECTORY;
  if(!mountPath||!dataDirectory||!path.isAbsolute(mountPath)||!path.isAbsolute(dataDirectory))throw new Error("PERSISTENT_STORAGE_PATH_REQUIRED");
  const mount=path.resolve(mountPath);const data=path.resolve(dataDirectory);
  if(data===mount||!data.startsWith(`${mount}${path.sep}`))throw new Error("PERSISTENT_STORAGE_DATA_PATH_OUTSIDE_MOUNT");
  const provided=mountInfo!==undefined;const mounted=parseMountInfo(mountInfo??readFileSync("/proc/self/mountinfo","utf8")).find(item=>path.resolve(item.mountPoint)===mount);
  if(!mounted||["overlay","tmpfs","ramfs"].includes(mounted.fileSystem))throw new Error("PERSISTENT_STORAGE_NOT_MOUNTED");
  if(!provided)accessSync(mount,constants.R_OK|constants.W_OK);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))checkPersistentStorage();
