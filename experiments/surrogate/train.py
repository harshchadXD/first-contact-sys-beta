"""CPU-only supervised surrogate experiment. Labels are exact sampled Rust geometry.
Run from any directory; NumPy is the only training dependency.
"""
import os
os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
import sys,json,gzip,time,copy
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
# Reuse the existing local vendor only when present; Colab/Kaggle normally provide NumPy.
vendor=ROOT/'shaurya_work/Firstcontact.sys - Copy/backend/.raster-vendor'
if vendor.exists():sys.path.insert(0,str(vendor))
import numpy as np

def sigmoid(z):return 1/(1+np.exp(-np.clip(z,-40,40)))
def forward(x,weights):
    a=np.tanh(x@weights[0]+weights[1]);b=np.tanh(a@weights[2]+weights[3]);y=sigmoid(b@weights[4]+weights[5]);return a,b,y

def main():
    start=time.perf_counter();rng=np.random.default_rng(2026)
    doc=json.loads(gzip.decompress((HERE/'labels.json.gz').read_bytes()));rows=doc['rows']
    x=np.array([r['features'] for r in rows],dtype=np.float64);y=np.array([r['targets'] for r in rows],dtype=np.float64)
    pos=np.array([r['positionIndex'] for r in rows]);arrival=np.array([r['arrivalDay'] for r in rows]);days=np.array([r['durationHours']/24 for r in rows]);spatial=(pos%5==4)
    train=(~spatial)&(arrival+days<=16)
    validation=(~spatial)&(arrival>=17)&(arrival+days<=23)
    masks={'validation':validation,'spatial_holdout':spatial&(arrival+days<=16),'temporal_holdout':(~spatial)&(arrival>=24),'joint_holdout':spatial&(arrival>=24)}
    assert train.any() and all(m.any() for m in masks.values())
    assert not any((train&m).any() for m in masks.values())
    # Every training target interval ends by day 16; every temporal/joint test starts on or after day 24.
    assert (arrival[train]+days[train]).max()<=16 and arrival[masks['temporal_holdout']].min()>=24
    mean=x[train].mean(0);scale=np.maximum(x[train].std(0),1e-6);x=(x-mean)/scale
    weights=[rng.normal(0,.15,(x.shape[1],48)),np.zeros(48),rng.normal(0,.15,(48,32)),np.zeros(32),rng.normal(0,.15,(32,4)),np.zeros(4)]
    # Gradient self-check against a central finite difference.
    probe=x[train][:5];target=y[train][:5];a,b,pred=forward(probe,weights)
    dz=2*(pred-target)*pred*(1-pred)/pred.size;analytic=(b.T@dz)[0,0]
    epsilon=1e-6;weights[4][0,0]+=epsilon;plus=np.mean((forward(probe,weights)[2]-target)**2);weights[4][0,0]-=2*epsilon;minus=np.mean((forward(probe,weights)[2]-target)**2);weights[4][0,0]+=epsilon
    assert abs((plus-minus)/(2*epsilon)-analytic)<1e-7
    m=[np.zeros_like(w) for w in weights];v=[np.zeros_like(w) for w in weights];step=0;best=1e9;best_weights=None;history=[];stale=0
    indexes=np.flatnonzero(train)
    for epoch in range(1,241):
        rng.shuffle(indexes)
        for j in range(0,len(indexes),256):
            ids=indexes[j:j+256];xx=x[ids];yy=y[ids];a,b,pred=forward(xx,weights)
            dz=2*(pred-yy)*pred*(1-pred)/pred.size;db=(dz@weights[4].T)*(1-b*b);da=(db@weights[2].T)*(1-a*a)
            grads=[xx.T@da,da.sum(0),a.T@db,db.sum(0),b.T@dz,dz.sum(0)]
            step+=1
            for i,g in enumerate(grads):
                m[i]=.9*m[i]+.1*g;v[i]=.999*v[i]+.001*g*g
                weights[i]-=.002*(m[i]/(1-.9**step))/(np.sqrt(v[i]/(1-.999**step))+1e-8)
        if epoch%10==0:
            loss=float(np.mean((forward(x[validation],weights)[2]-y[validation])**2));history.append({'epoch':epoch,'validationMSE':loss})
            print('Epoch',epoch,'validation MSE',round(loss,6),flush=True)
            if loss<best-1e-6:best=loss;best_weights=copy.deepcopy(weights);stale=0
            else:stale+=1
            if stale>=6:break
    weights=best_weights;reports={};baseline=y[train].mean(0)
    for name,mask in masks.items():
        predicted=forward(x[mask],weights)[2];error=np.abs(predicted-y[mask]);d=days[mask]*24
        exact_ok=(y[mask,2]*d<=24)&(y[mask,3]*d>=4)
        predicted_ok=(predicted[:,2]*d<=24)&(predicted[:,3]*d>=4)
        reports[name]={'cases':int(mask.sum()),'meanAbsoluteError':error.mean(0).tolist(),'p95AbsoluteError':np.quantile(error,.95,axis=0).tolist(),'constantBaselineMAE':np.abs(baseline-y[mask]).mean(0).tolist(),'falseFeasibleCases':int((predicted_ok&~exact_ok).sum()),'missedFeasibleCases':int((~predicted_ok&exact_ok).sum()),'exactFeasibleCases':int(exact_ok.sum())}
    t=time.perf_counter();forward(x,weights);inference_ms=(time.perf_counter()-t)*1000
    report={'status':'TRAINED_EXPERIMENTAL','seed':2026,'architecture':'19 → 48 tanh → 32 tanh → 4 sigmoid; Adam; CPU NumPy','trainingCases':int(train.sum()),'totalLabelledCases':len(rows),'splits':reports,'history':history,'trainingAndEvaluationSeconds':time.perf_counter()-start,'batchInferenceMilliseconds':inference_ms,'exactRustGenerationMilliseconds':doc['metadata']['exactEngineMilliseconds'],'featureNames':doc['metadata']['features'],'targetNames':doc['metadata']['targets'],'sourceManifest':doc['metadata'],'deploymentDecision':'RESEARCH_ONLY','limitations':['One geographical region. Spatial holdouts are nearby positions, not an independent lunar site.','Temporal/joint holdouts start at least eight days after all training target intervals end. Validation contains shorter windows.','Model labels are sampled geometric simulator outputs, not observations of mission success.','Timing is a CPU batch inference measurement versus separately measured Rust calls including JSON; not an end-to-end speedup claim.','False feasible predictions require exact Rust verification. No model result certifies mission viability.','No production surrogate integration is justified by this experiment alone.']}
    artifact={'schemaVersion':1,'modelType':'dense-tanh-sigmoid','featureNames':doc['metadata']['features'],'targetNames':doc['metadata']['targets'],'inputMean':mean.tolist(),'inputScale':scale.tolist(),'weights':[w.tolist() for w in weights],'trainingSeed':2026,'scope':'Single-region experimental surrogate; exact Rust verification mandatory.'}
    (HERE/'model.json').write_text(json.dumps(artifact,separators=(',',':')))
    (HERE/'evaluation.json').write_text(json.dumps(report,indent=2))
    print('TRAINED',int(train.sum()),'cases; wrote model.json and evaluation.json. Research only.',flush=True)
if __name__=='__main__':main()
