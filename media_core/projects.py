"""Project color settings and per-Read interpretations, stored independently."""
import json
from pathlib import Path
from uuid import uuid4
from . import color as cm


def project_file(root, project_id):
    return Path(root)/'projects'/f'{project_id}.json'


def write(path, value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_name(f'.{path.stem}.{uuid4().hex}.tmp')
    temporary.write_text(json.dumps(value,indent=2))
    temporary.replace(path)


def attach(job_id,job,root):
    if 'precision' not in job:return
    if not job.get('project_id'):
        previous=job.get('color',{})
        name=previous.get('config') or cm.default_id()
        if not previous.get('config') and previous.get('working_space') and cm.canonical(previous['working_space'],name) is None:
            if cm.canonical(previous['working_space'],cm.BUILTIN) is not None:name=cm.BUILTIN
        job['project_id']=job_id
        value={'id':job_id,'color':{'config':name,
             'working_space':previous.get('working_space') or cm.info(name)['working_default']},'revision':1}
        write(project_file(root,job_id),value)
    if 'read' not in job:
        old=job.get('color',{})
        job['read']={'input_space':old.get('input_space',job['precision'].get('input_space')),
                     'alpha_mode':old.get('alpha_mode',job['precision'].get('alpha_mode','premultiplied'))}


def load(job,root):
    return json.loads(project_file(root,job['project_id']).read_text())


def update(job,root,data):
    project=load(job,root)
    name=data.get('config',project['color']['config'])
    cfg=cm.config(name)
    working=data.get('working_space') or cfg.getRoleColorSpace('scene_linear')
    if cfg.getColorSpace(working) is None:raise ValueError('Choose a Working Space from the project OCIO config.')
    project['color']={'config':name,'working_space':working}
    project['revision']+=1
    write(project_file(root,project['id']),project)
    return project


def resolve(job,root):
    project=load(job,root)
    from .pipeline import settings
    return settings({**job['read'],**project['color']},job['precision'])
