P,R,N = 39,59,99
anchors = {0:(0,0,0), 3:(20,4,1), 6:(65,18,4), 12:(105,36,9)}
def interp(m):
    ks=sorted(anchors); 
    for i in range(len(ks)-1):
        a,b=ks[i],ks[i+1]
        if a<=m<=b:
            t=(m-a)/(b-a)
            return tuple(round(anchors[a][j]+t*(anchors[b][j]-anchors[a][j])) for j in range(3))
mesi=['ott 26','nov','dic 26','gen 27','feb','mar 27','apr','mag','giu','lug','ago','set 27']
tot=0; rows=[]
for m in range(1,13):
    p,r,n=interp(m); mrr=p*P+r*R+n*N; tot+=mrr
    rows.append((m,mesi[m-1],p,r,n,mrr,tot))
print(f"{'M':>3} {'mese':<7} {'prov':>4} {'reg':>4} {'naz':>4} {'MRR':>7} {'cum':>8}")
for m,me,p,r,n,mrr,c in rows: print(f"{m:>3} {me:<7} {p:>4} {r:>4} {n:>4} {mrr:>7} {c:>8}")
print()
print("CUMULATA Y1 base      =", tot, "  (doc dice 64.000 -> gonfiata di", 64000-tot, "= +%.0f%%)"%((64000-tot)/tot*100))
print("conservativo -40%%     = %.0f  (doc dice 38.000)"%(tot*0.6))
print("ottimistico  +60%%     = %.0f  (doc dice 102.000)"%(tot*1.6))
print()
for lbl,f in [('base',1.0),('conserv -40%',0.6),('ottim +60%',1.6)]:
    print(f"{lbl:<14} MRR M12 = {7110*f:>8.0f}   ARR run-rate = {7110*f*12:>9.0f}")
print()
# break-even
print("Break-even: costi ~200/mese -> MRR 250 superato al mese", next(m for m,_,_,_,_,mrr,_ in rows if mrr>=250))
print("Primo mese con MRR >= 250:", [ (m,mrr) for m,_,_,_,_,mrr,_ in rows ][:3])
# conversione
print()
print("Conversione free->paid: M3 %d/80=%.0f%%  M6 %d/180=%.0f%%  M12 %d/300=%.0f%%"%(25,25/80*100,87,87/180*100,150,150/300*100))
# sensitivity conversione a M12
print()
print("Sensitivity conversione a M12 (300 registrati, mix 70/24/6):")
for conv in (0.10,0.20,0.30,0.50):
    tot_p=300*conv; p,r,n=tot_p*.70,tot_p*.24,tot_p*.06
    mrr=p*P+r*R+n*N
    print("  conv %3.0f%% -> %3.0f paganti -> MRR M12 %6.0f  (ARR %7.0f)"%(conv*100,tot_p,mrr,mrr*12))
