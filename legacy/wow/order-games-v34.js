// V35 compatibility bridge. The order page keeps its stable import path while
// the old nine independent forms are replaced by one story questionnaire.
import { mountStoryBuilder,collectStoryBuild,refreshStoryLimits } from "./story-builder-v35.js";

export function mountOrderGames(){
  mountStoryBuilder({getPackage:()=>document.querySelector(".pkg.active")?.dataset.id||"memory"});
  document.querySelectorAll(".pkg").forEach(card=>card.addEventListener("click",()=>queueMicrotask(refreshStoryLimits)));
}

export function collectOrderGames(imageCount=0){
  const build=collectStoryBuild(imageCount);
  const games=build.games.map((x,i)=>i===0?{...x,config:{...x.config,__storyBuild:build}}:x);
  return games.length?games:[{game:"setup",config:{__storyBuild:build}}];
}
