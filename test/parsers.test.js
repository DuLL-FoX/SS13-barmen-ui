import test from "node:test";
import assert from "node:assert/strict";
import { parseChemDispenserSources, parseChemicalReactions, parseReagents } from "../src/data/parsers.js";

const tierMap = (machine) => Object.fromEntries(machine.tiers.map((t) => [t.key, t.reagents]));

test("dispenser tiers are matched by exact property name", () => {
  const dm = `
/obj/machinery/chem_dispenser/drinks
	name = "Soda Dispenser"
	dispensable_reagents = list(
		/datum/reagent/water,
		/datum/reagent/consumable/ice, // trailing comment
	)
	upgrade_reagents = list(
		/datum/reagent/consumable/banana
	)
	upgrade_reagents2 = list(
		/datum/reagent/consumable/watermelonjuice
	)
	upgrade_reagents3 = list(/datum/reagent/consumable/peachjuice)
	emagged_reagents = list(
		/datum/reagent/toxin/mindbreaker
	)
`;
  const machines = parseChemDispenserSources(dm);
  assert.equal(machines.length, 1);
  assert.equal(machines[0].name, "Soda Dispenser");
  const tiers = tierMap(machines[0]);
  assert.deepEqual(tiers.base, ["/datum/reagent/consumable/ice", "/datum/reagent/water"]);
  assert.deepEqual(tiers.upgrade1, ["/datum/reagent/consumable/banana"]);
  assert.deepEqual(tiers.upgrade2, ["/datum/reagent/consumable/watermelonjuice"]);
  assert.deepEqual(tiers.upgrade3, ["/datum/reagent/consumable/peachjuice"]);
  assert.deepEqual(tiers.emag, ["/datum/reagent/toxin/mindbreaker"]);
});

test("modular tier-4 declarations with var/list prefix and null overrides are parsed", () => {
  const dm = `
/obj/machinery/chem_dispenser
	var/list/upgrade_reagents4 = list(
		/datum/reagent/toxin/slimejelly
	)

/obj/machinery/chem_dispenser/drinks
	upgrade_reagents4 = list(
		/datum/reagent/toxin/teapowder,
		/datum/reagent/consumable/caramel
	)

/obj/machinery/chem_dispenser/drinks/beer
	upgrade_reagents4 = null
`;
  const machines = parseChemDispenserSources(dm);
  const byPath = Object.fromEntries(machines.map((m) => [m.path, tierMap(m)]));
  assert.deepEqual(byPath["/obj/machinery/chem_dispenser"].upgrade4, ["/datum/reagent/toxin/slimejelly"]);
  assert.deepEqual(byPath["/obj/machinery/chem_dispenser/drinks"].upgrade4, [
    "/datum/reagent/consumable/caramel",
    "/datum/reagent/toxin/teapowder"
  ]);
  assert.equal(byPath["/obj/machinery/chem_dispenser/drinks/beer"], undefined, "null override yields no tiers");
});

test("reagents added inside Initialize() via LAZYADD or += are attributed to the machine", () => {
  const dm = `
/obj/machinery/chem_dispenser/drinks/beer/Initialize()
	var/list/extra_reagents = list(
		/datum/reagent/consumable/ethanol/curacao,
		/datum/reagent/consumable/ethanol/navy_rum
	)
	LAZYADD(dispensable_reagents, extra_reagents)
	. = ..()

/obj/machinery/chem_dispenser/mutagen/Initialize(mapload)
	. = ..()
	emagged_reagents += list(/datum/reagent/toxin/plasma)
`;
  const machines = parseChemDispenserSources(dm);
  const byPath = Object.fromEntries(machines.map((m) => [m.path, tierMap(m)]));
  assert.deepEqual(byPath["/obj/machinery/chem_dispenser/drinks/beer"].base, [
    "/datum/reagent/consumable/ethanol/curacao",
    "/datum/reagent/consumable/ethanol/navy_rum"
  ]);
  assert.deepEqual(byPath["/obj/machinery/chem_dispenser/mutagen"].emag, ["/datum/reagent/toxin/plasma"]);
});

test("a following non-dispenser type ends the dispenser block", () => {
  const dm = `
/obj/machinery/chem_dispenser/drinks
	dispensable_reagents = list(/datum/reagent/water)

/obj/item/circuitboard/machine/chem_dispenser/drinks
	name = "Soda Dispenser (Machine Board)"
	upgrade_reagents = list(/datum/reagent/should/not/appear)
`;
  const machines = parseChemDispenserSources(dm);
  assert.equal(machines.length, 1);
  assert.equal(machines[0].name, null);
  assert.deepEqual(tierMap(machines[0]), { base: ["/datum/reagent/water"] });
});

test("chemical reactions parse names, results and requirements", () => {
  const dm = `
/datum/chemical_reaction/goldschlager
	name = "Goldschlager"
	id = /datum/reagent/consumable/ethanol/goldschlager
	results = list(/datum/reagent/consumable/ethanol/goldschlager = 10)
	required_reagents = list(/datum/reagent/consumable/ethanol/vodka = 10, /datum/reagent/gold = 1)
	mix_message = "The mixture sparkles."
`;
  const [recipe] = parseChemicalReactions(dm);
  assert.equal(recipe.name, "Goldschlager");
  assert.deepEqual(recipe.results, [{ path: "/datum/reagent/consumable/ethanol/goldschlager", quantity: 10 }]);
  assert.equal(recipe.requiredReagents.length, 2);
  assert.equal(recipe.mixMessage, "The mixture sparkles.");
});

test("reagents parse glass icon and booze power", () => {
  const dm = `
/datum/reagent/consumable/ethanol/vodka
	name = "Vodka"
	boozepwr = 65
	glass_icon_state = "ginvodkaglass"
`;
  const reagents = parseReagents(dm);
  const vodka = reagents.get("/datum/reagent/consumable/ethanol/vodka");
  assert.equal(vodka.name, "Vodka");
  assert.equal(vodka.boozePower, 65);
  assert.equal(vodka.glassIconState, "ginvodkaglass");
});
