from pathlib import Path
import re
root=Path(__file__).parent
out=root/'dist'
modules=[('engine.js','EngineModule',['GameEngine','LEVELS','SKINS']),('renderer.js','RendererModule',['StadiumRenderer']),('audio.js','AudioModule',['GameAudio'])]
chunks=[]
for filename,namespace,exports in modules:
    code=(out/filename).read_text().replace('export class ','class ').replace('export const ','const ')
    chunks.append('const '+namespace+' = (()=>{\n'+code+'\nreturn {'+','.join(exports)+'};\n})();')
app=(out/'app.js').read_text()
app=re.sub(r"import \{GameEngine, LEVELS, SKINS\} from './engine.js';",'const {GameEngine,LEVELS,SKINS}=EngineModule;',app)
app=re.sub(r"import \{StadiumRenderer\} from './renderer.js';",'const {StadiumRenderer}=RendererModule;',app)
app=re.sub(r"import \{GameAudio\} from './audio.js';",'const {GameAudio}=AudioModule;',app)
script='(()=>{\n'+ '\n'.join(chunks)+'\n'+app+'\n})();'
(out/'game.js').write_text(script)
html=(root/'index.template.html').read_text()
(out/'index.html').write_text(html.replace('<script type="module" src="app.js"></script>','<script src="game.js"></script>'))
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+ (out/'style.css').read_text()+'</style>')
html=re.sub(r'<link rel="(?:icon|apple-touch-icon|manifest)"[^>]+>', '', html)
html=html.replace('<script type="module" src="app.js"></script>','<script>'+script.replace('</script','<\\/script')+'</script>')
(root/'Nightstrike.html').write_text(html)
print('Built self-contained Nightstrike.html:',(root/'Nightstrike.html').stat().st_size,'bytes')
