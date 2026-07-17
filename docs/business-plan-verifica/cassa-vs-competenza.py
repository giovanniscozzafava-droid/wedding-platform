P,R,N=39,59,99
anchors={0:(0,0,0),3:(20,4,1),6:(65,18,4),12:(105,36,9)}
def interp(m):
    ks=sorted(anchors)
    for i in range(len(ks)-1):
        a,b=ks[i],ks[i+1]
        if a<=m<=b:
            t=(m-a)/(b-a)
            return tuple(anchors[a][j]+t*(anchors[b][j]-anchors[a][j]) for j in range(3))
act=[interp(m) for m in range(0,13)]
def cash(a):  # a = quota di nuovi che paga ANNUALE anticipato (12x, nessuno sconto)
    tot=0
    for m in range(1,13):
        for j,pr in enumerate((P,R,N)):
            adds=act[m][j]-act[m-1][j]
            tot += adds*a*12*pr          # annuali: incassano 12 mesi subito
            tot += act[m][j]*(1-a)*pr    # mensili: incassano il mese
    return tot
print("quota annuale -> cassa incassata Y1")
for a in (0,.25,.5,.75,1.0): print("  %4.0f%% -> %8.0f EUR"%(a*100,cash(a)))
lo,hi=0,1
for _ in range(60):
    mid=(lo+hi)/2
    if cash(mid)<64000: lo=mid
    else: hi=mid
print("\nquota annuale necessaria per arrivare a 64.000 EUR di CASSA: %.0f%%"%(hi*100))
print("cassa con 100%% annuale (tetto teorico, zero sconto): %.0f EUR"%cash(1.0))
print("\nprezzi annuali del doc: 39*12=%d (doc 468) | 59*12=%d (doc 708) | 99*12=%d (doc 1188) -> sconto annuale = 0%%"%(39*12,59*12,99*12))
