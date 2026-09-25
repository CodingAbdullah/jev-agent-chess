"use client";

import { FlagIcon, HandshakeIcon, LoaderCircleIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DrawOffer } from "@/hooks/use-draw-offer";
import { opponent, type Color } from "@/lib/chess/game";

type GameActionsProps = {
  /** The side that resigns or offers: you against the computer, the side to move otherwise. */
  side: Color;
  names: Record<Color, string>;
  /** Offers are made on your own turn, once per position. */
  canOffer: boolean;
  offer: DrawOffer | null;
  /** The computer's name, or null in a two-player game. */
  computer: string | null;
  onOfferDraw: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onResign: () => void;
};

/** Resign and draw offers, shown while a game is in progress. */
export function GameActions({
  side,
  names,
  canOffer,
  offer,
  computer,
  onOfferDraw,
  onAccept,
  onDecline,
  onResign,
}: GameActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const who = computer ? "" : ` as ${names[side]}`;

  return (
    <div className="flex flex-col gap-3" data-testid="game-actions">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onOfferDraw} disabled={!canOffer}>
          <HandshakeIcon aria-hidden="true" />
          Offer draw
        </Button>
        <Button variant="outline" onClick={() => setConfirming(true)}>
          <FlagIcon aria-hidden="true" />
          Resign
        </Button>
      </div>

      <div aria-live="polite" data-testid="draw-offer">
        {offer?.state === "asking" && (
          <p className="flex items-center gap-2 text-sm">
            <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
            {computer} is considering your offer…
          </p>
        )}
        {offer?.state === "pending" && (
          <div className="flex flex-col gap-2 rounded-md border p-3">
            <p className="text-sm font-medium">
              {names[offer.by]} offers a draw. {names[opponent(offer.by)]}, do you accept?
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={onAccept}>
                Accept draw
              </Button>
              <Button size="sm" variant="outline" onClick={onDecline}>
                Decline
              </Button>
            </div>
          </div>
        )}
        {offer?.state === "answered" && (
          <p className={offer.failed ? "text-destructive text-sm" : "text-muted-foreground text-sm"}>{offer.message}</p>
        )}
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Resign{who}?</DialogTitle>
            <DialogDescription>
              {computer
                ? `The game ends and ${computer} wins.`
                : `The game ends and ${names[opponent(side)]} wins.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Keep playing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirming(false);
                onResign();
              }}
            >
              Resign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
