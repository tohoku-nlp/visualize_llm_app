from types import SimpleNamespace

import torch
import pytest

import backend
from prompt import check_answer_correctness, get_expected_token_ids


class FakeModel:
    cfg = SimpleNamespace(d_vocab=4, n_layers=1, n_heads=1)

    def to_tokens(self, text: str, prepend_bos: bool = False) -> torch.Tensor:
        del prepend_bos
        tokenizations = {
            "Hello": [0],
            "Hello ,": [0, 2],
            "Hello,": [0, 1],
        }
        return torch.tensor([tokenizations[text]])


def test_expected_token_ids_include_space_variants_without_duplicates():
    model = FakeModel()

    assert get_expected_token_ids(model, "Hello", ",") == [2, 1]


def test_correctness_and_ranks_use_the_same_token_candidates():
    model = FakeModel()
    output_logits = torch.tensor([[[0.0, 10.0, 2.0, 5.0]]])
    layer_logits = torch.tensor([[0.0, 10.0, 2.0, 5.0]])
    head_logits = torch.tensor([[[0.0, 3.0, 8.0, 5.0]]])

    assert check_answer_correctness(model, "Hello", output_logits, ",") is True

    ranks = backend.calculate_ranks(
        model,
        "Hello",
        ",",
        layer_logits,
        head_logits,
    )

    assert ranks["MLP0"] == 1
    assert ranks["A0.H0"] == 1
    assert ranks["Output"] == 1


@pytest.mark.parametrize("retokenized", [[3, 1], [3]])
def test_retokenized_prompt_is_not_used_for_correctness_or_ranks(retokenized):
    class BoundaryModel(FakeModel):
        def to_tokens(self, text, prepend_bos=False):
            return torch.tensor([{
                "a": [0],
                "a bird": [0, 2],
                "abird": retokenized,
            }[text]])

    model = BoundaryModel()
    values = torch.tensor([0.0, 10.0, 2.0, 5.0])
    assert get_expected_token_ids(model, "a", "bird") == [2]
    assert check_answer_correctness(model, "a", values[None, None], "bird") is False
    ranks = backend.calculate_ranks(
        model, "a", "bird", values[None], values[None, None]
    )
    assert ranks["MLP0"] == ranks["A0.H0"] == ranks["Output"] == 3
